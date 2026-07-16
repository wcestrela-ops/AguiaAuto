/** Banners de erro e sucesso reutilizáveis nas páginas admin. */
export default function PageAlerts({ error, message }) {
  return (
    <>
      {error ? <div className="alert error">{error}</div> : null}
      {message ? <div className="alert success">{message}</div> : null}
    </>
  );
}
