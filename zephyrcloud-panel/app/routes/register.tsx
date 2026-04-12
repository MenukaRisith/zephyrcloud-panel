import { redirect } from "react-router";

import { PANEL_DESCRIPTION, pageTitle } from "../lib/brand";
import type { Route } from "./+types/register";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Sign in") },
    { name: "description", content: PANEL_DESCRIPTION },
  ];
}

export async function loader() {
  return redirect("/login");
}

export async function action() {
  return redirect("/login");
}

export default function RegisterRoute() {
  return null;
}
