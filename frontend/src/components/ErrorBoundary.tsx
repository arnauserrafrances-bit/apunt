import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Si una part de la pantalla falla, mostra el missatge de l'error en lloc de deixar la pàgina en blanc.
 * Les dades no es perden: són al navegador.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Apunt]", this.props.label ?? "app", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="warn-box space-y-2" role="alert">
        <p className="font-bold">{this.props.label ? `Hi ha hagut un error a: ${this.props.label}` : "Hi ha hagut un error"}</p>
        <p className="font-mono text-sm break-words">{error.name}: {error.message}</p>
        <p className="text-sm">Les teves dades estan desades. Fes una captura d'aquest missatge i torna-ho a provar.</p>
        <button className="btn btn-secondary min-h-9 px-3 text-base" onClick={() => this.setState({ error: null })}>
          Torna-ho a provar
        </button>
      </div>
    );
  }
}
