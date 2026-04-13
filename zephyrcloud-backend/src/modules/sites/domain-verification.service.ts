import * as dns from 'node:dns/promises';

import { Injectable } from '@nestjs/common';
import { parse } from 'tldts';

export type RoutingMode =
  | 'subdomain_cname'
  | 'apex_flattening'
  | 'apex_alias';

export type VerificationResult = {
  ok: boolean;
  routingMode: RoutingMode;
  observedTarget: string | null;
  resolvedChain: string[];
  message: string;
};

@Injectable()
export class DomainVerificationService {
  public isApex(domain: string): boolean {
    const parsed = parse(domain);
    if (!parsed.domain) return false;
    return !parsed.subdomain;
  }

  public classifyDomain(domain: string): RoutingMode {
    return this.isApex(domain) ? 'apex_alias' : 'subdomain_cname';
  }

  public async verify(
    domain: string,
    expectedTarget: string,
  ): Promise<VerificationResult> {
    const normalizedDomain = this.normalizeHost(domain);
    const normalizedTarget = this.normalizeHost(expectedTarget);
    const apex = this.isApex(normalizedDomain);

    if (!apex) {
      return this.verifySubdomainCname(normalizedDomain, normalizedTarget);
    }

    return this.verifyApexRouting(normalizedDomain, normalizedTarget);
  }

  private async verifySubdomainCname(
    domain: string,
    expectedTarget: string,
  ): Promise<VerificationResult> {
    const chain = await this.resolveCnameChain(domain);
    const observedTarget = chain[chain.length - 1] ?? null;

    if (observedTarget && observedTarget === expectedTarget) {
      return {
        ok: true,
        routingMode: 'subdomain_cname',
        observedTarget,
        resolvedChain: chain,
        message: `CNAME points to ${expectedTarget}.`,
      };
    }

    const ipHints = await this.resolveAddresses(domain);
    const message = observedTarget
      ? `CNAME points to ${observedTarget}, expected ${expectedTarget}.`
      : ipHints.length > 0
        ? `Subdomains must use a CNAME to ${expectedTarget}, but ${domain} currently resolves directly to IP addresses.`
        : `No CNAME record found for ${domain} yet.`;

    return {
      ok: false,
      routingMode: 'subdomain_cname',
      observedTarget,
      resolvedChain: chain,
      message,
    };
  }

  private async verifyApexRouting(
    domain: string,
    expectedTarget: string,
  ): Promise<VerificationResult> {
    const chain = await this.resolveCnameChain(domain);
    const observedTarget = chain[chain.length - 1] ?? null;

    if (observedTarget && observedTarget === expectedTarget) {
      return {
        ok: true,
        routingMode: 'apex_flattening',
        observedTarget,
        resolvedChain: chain,
        message: `Root domain resolves to ${expectedTarget}.`,
      };
    }

    const [domainAddresses, targetAddresses] = await Promise.all([
      this.resolveAddresses(domain),
      this.resolveAddresses(expectedTarget),
    ]);

    if (
      domainAddresses.length > 0 &&
      targetAddresses.length > 0 &&
      this.sameAddressSet(domainAddresses, targetAddresses)
    ) {
      return {
        ok: true,
        routingMode: 'apex_alias',
        observedTarget: expectedTarget,
        resolvedChain: chain,
        message: `Root domain resolves to the same IPs as ${expectedTarget}.`,
      };
    }

    const message =
      domainAddresses.length > 0
        ? `Root domain does not resolve to the expected target ${expectedTarget}.`
        : `No compatible apex routing detected for ${domain}. Point it to ${expectedTarget} using Cloudflare flattening or ALIAS/ANAME.`;

    return {
      ok: false,
      routingMode: observedTarget ? 'apex_flattening' : 'apex_alias',
      observedTarget,
      resolvedChain: chain,
      message,
    };
  }

  private async resolveCnameChain(host: string): Promise<string[]> {
    const chain: string[] = [];
    let current = host;

    for (let depth = 0; depth < 10; depth += 1) {
      try {
        const records = await dns.resolveCname(current);
        const next = this.normalizeHost(records[0] ?? '');
        if (!next) break;
        chain.push(next);
        current = next;
      } catch {
        break;
      }
    }

    return chain;
  }

  private async resolveAddresses(host: string): Promise<string[]> {
    const [v4, v6] = await Promise.allSettled([
      dns.resolve4(host),
      dns.resolve6(host),
    ]);

    const addresses = new Set<string>();
    if (v4.status === 'fulfilled') {
      for (const entry of v4.value) addresses.add(entry);
    }
    if (v6.status === 'fulfilled') {
      for (const entry of v6.value) addresses.add(entry);
    }

    return Array.from(addresses).sort();
  }

  private sameAddressSet(left: string[], right: string[]): boolean {
    if (left.length === 0 || right.length === 0) return false;
    if (left.length !== right.length) return false;
    return left.every((value, index) => value === right[index]);
  }

  private normalizeHost(value: string): string {
    return value.trim().toLowerCase().replace(/\.$/, '');
  }
}
