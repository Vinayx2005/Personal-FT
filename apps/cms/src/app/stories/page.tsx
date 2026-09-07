import AuthGate from '../AuthGate';
import StoryList from '../StoryList';

export default function StoryListPage() {
  return (
    <AuthGate>
      <StoryList />
    </AuthGate>
  );
}
