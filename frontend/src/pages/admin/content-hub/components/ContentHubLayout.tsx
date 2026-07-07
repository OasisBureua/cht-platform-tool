// Content Hub layout element — mounted once under the /admin/content-hub route tree.
// Provides the scoped toast context to every Content Hub page and renders the nested
// route via <Outlet/>. It adds NO visual chrome of its own: app-chrome pages opt into
// the header + container through <ChromeContainer>, and the full-bleed report viewers
// render directly. This whole subtree already lives inside the platform's AdminLayout.
import { Outlet } from 'react-router-dom';
import { ContentHubToastProvider } from './Toaster';

export default function ContentHubLayout() {
  return (
    <ContentHubToastProvider>
      <Outlet />
    </ContentHubToastProvider>
  );
}
