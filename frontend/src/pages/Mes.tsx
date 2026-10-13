import { Link } from "react-router";
import { PageTitle, ResetDataButton } from "../components/Layout";

/** Menú "Més" del mòbil: pantalles que es fan servir poc. */
export default function Mes() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title="Més" />
      <ul className="divide-y divide-line rounded-xl border border-line bg-card">
        <li>
          <Link to="/alumnes" className="block px-4 py-4 hover:bg-hover">
            <div className="font-bold">Alumnes</div>
            <div className="text-muted">Llista de la classe i codis</div>
          </Link>
        </li>
        <li>
          <Link to="/arees" className="block px-4 py-4 hover:bg-hover">
            <div className="font-bold">Àrees</div>
            <div className="text-muted">Afegir, canviar el nom, ordenar i moure notes</div>
          </Link>
        </li>
      </ul>
      <div className="mt-10">
        <ResetDataButton />
      </div>
    </div>
  );
}
