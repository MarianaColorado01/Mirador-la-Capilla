import type { ReactNode } from 'react';
import type { Role } from '@mirador/shared';
import { useSession } from '@/store/session';
import { Screen } from './Screen';
import { StateView } from './StateView';

/** Muestra la pantalla solo a los roles indicados (el servidor también lo verifica, RN-09). */
export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useSession((s) => s.user?.role);
  if (!role || !roles.includes(role)) {
    return (
      <Screen>
        <StateView kind="empty" icon="lock-outline" title="Tu perfil no tiene acceso" message="Esta opción es para otro rol." />
      </Screen>
    );
  }
  return <>{children}</>;
}
