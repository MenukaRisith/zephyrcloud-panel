// app/routes/logout.tsx
import { logout } from "../services/session.server";

export async function action({ request }: { request: Request }) {
  return logout(request);
}

export default function Logout() {
  return null;
}
