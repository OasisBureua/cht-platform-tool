import { Navigate } from 'react-router-dom';

export default function Programs() {
  // Legacy route (old nav). Keep for backward compatibility.
  return <Navigate to="/webinars" replace />;
}
