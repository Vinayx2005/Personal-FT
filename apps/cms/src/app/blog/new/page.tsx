import AuthGate from '../../AuthGate';
import BlogEditor from '../../BlogEditor';

export default function NewBlogPost() {
  return (
    <AuthGate>
      <BlogEditor id="new" />
    </AuthGate>
  );
}
