import { redirect } from "next/navigation";

export default function Home() {
  // El proxy envía a /acceso si no hay sesión; con sesión, aquí empieza el portal.
  redirect("/portal");
}
