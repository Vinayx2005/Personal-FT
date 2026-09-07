import AuthGate from '../../AuthGate';
import StoryEditor from '../../StoryEditor';

export default function EditStory({ params }: { params: { id: string } }) {
  return (
    <AuthGate>
      <StoryEditor id={params.id} />
    </AuthGate>
  );
}
