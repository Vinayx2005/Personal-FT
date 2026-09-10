import AuthGate from '../AuthGate';
import UsersList from '../UsersList';

export default function UsersPage() {
  return (
    <AuthGate>
      <UsersList />
    </AuthGate>
  );
}
