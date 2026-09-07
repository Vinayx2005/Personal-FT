import AuthGate from '../AuthGate';
import BlogList from '../BlogList';

export default function BlogListPage() {
  return (
    <AuthGate>
      <BlogList />
    </AuthGate>
  );
}
