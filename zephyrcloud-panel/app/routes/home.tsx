import { redirect } from "react-router";

import type { Route } from "./+types/home";
import { getSession } from "../services/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  const accessToken = session.get("accessToken") as string | undefined;

  return redirect(accessToken ? "/app" : "/login");
}

export default function Home() {
  return null;
}
