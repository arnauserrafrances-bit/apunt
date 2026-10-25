import { Navigate, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import Alumnes from "./pages/Alumnes";
import Arees from "./pages/Arees";
import Classe from "./pages/Classe";
import Fitxa from "./pages/Fitxa";
import { InformeAlumne, InformeIndex } from "./pages/Informe";
import Mes from "./pages/Mes";
import Model from "./pages/Model";
import NotaRapida from "./pages/NotaRapida";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<NotaRapida />} />
        <Route path="/classe" element={<Classe />} />
        <Route path="/alumne/:code" element={<Fitxa />} />
        <Route path="/informe" element={<InformeIndex />} />
        <Route path="/informe/:code" element={<InformeAlumne />} />
        <Route path="/alumnes" element={<Alumnes />} />
        <Route path="/arees" element={<Arees />} />
        <Route path="/mes" element={<Mes />} />
        <Route path="/model" element={<Model />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
