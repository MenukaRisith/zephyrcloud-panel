async function proxy(request: Request) {
  const { apiFetchAuthed } = await import("~/services/api.authed.server");

  const res = await apiFetchAuthed(request, "/api/github/connection", {
    method: request.method,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("Content-Type") || "application/json",
    },
  });
}

export function loader({ request }: { request: Request }) {
  return proxy(request);
}

export function action({ request }: { request: Request }) {
  return proxy(request);
}
