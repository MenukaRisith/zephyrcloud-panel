import { redirect } from "react-router";

function normalizeLegacyPath(pathname: string) {
  const stripped = pathname.replace(/^\/app(?=\/|$)/, "") || "/";
  return stripped.startsWith("/") ? stripped : `/${stripped}`;
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const targetPath = normalizeLegacyPath(url.pathname);
  const target = `${targetPath}${url.search}`;
  return redirect(target);
}

export default function LegacyAppRedirectRoute() {
  return null;
}
