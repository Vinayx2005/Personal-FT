import AuthGate from '../../AuthGate';
import BlogEditor from '../../BlogEditor';

export default function EditBlogPost({ params }: { params: { id: string } }) {
  return (
    <AuthGate>
      <BlogEditor id={params.id} />
    </AuthGate>
  );
}
