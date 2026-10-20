import { redirect } from "next/navigation";

export default function Home() {
  // Sin sesión abierta el portal empieza en la pantalla de acceso.
  redirect("/acceso");
}
