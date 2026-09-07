import AuthGate from '../../AuthGate';
import StoryEditor from '../../StoryEditor';

export default function NewStory() {
  return (
    <AuthGate>
      <StoryEditor id="new" />
    </AuthGate>
  );
}
