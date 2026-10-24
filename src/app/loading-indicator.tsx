export default function LoadingIndicator({label = "Loading…"}:{label?:string}) {
  return <span className="loading-indicator" role="status" aria-live="polite"><span className="loading-spinner" aria-hidden="true"/><span>{label}</span></span>;
}
