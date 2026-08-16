import { EmptyRow, Panel, UnitTag } from "@/shared/components/ui-kit";

import type { AccessData } from "../types";

export function RolePermissionMatrix({ data }: { data: AccessData }) {
  return (
    <Panel
      title="Matriz de papéis e permissões"
      description="Catálogo efetivo do banco, usuários atribuídos e escopos ativos por papel."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/60">
            <tr className="label-caps">
              <th className="px-4 py-2 text-left font-semibold">Papel</th>
              <th className="px-4 py-2 text-left font-semibold">Permissões por domínio</th>
              <th className="px-4 py-2 text-left font-semibold">Usuários</th>
              <th className="px-4 py-2 text-left font-semibold">Escopos</th>
            </tr>
          </thead>
          <tbody>
            {data.roles.length === 0 && <EmptyRow colSpan={4} label="Nenhum papel cadastrado." />}
            {data.roles.map((role) => {
              const assignments = data.assignments.filter(
                (assignment) => assignment.role_id === role.id && assignment.status === "active",
              );
              const permissionIds = new Set(
                data.rolePermissions
                  .filter((item) => item.role_id === role.id)
                  .map((item) => item.permission_id),
              );
              const permissions = data.permissions.filter((item) => permissionIds.has(item.id));
              const modules = permissions.reduce((groups, permission) => {
                const entries = groups.get(permission.module) ?? [];
                entries.push(permission);
                groups.set(permission.module, entries);
                return groups;
              }, new Map<string, typeof permissions>());
              const users = assignments
                .map((assignment) =>
                  data.profiles.find((profile) => profile.id === assignment.user_id),
                )
                .filter((profile) => profile !== undefined);
              const scopes = [...new Set(assignments.map((assignment) => assignment.unit_code))];

              return (
                <tr key={role.id} className="border-t align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{role.name}</p>
                    <p className="num text-xs text-muted-foreground">{role.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    {permissions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Sem permissões</span>
                    ) : (
                      <div className="space-y-2">
                        {[...modules.entries()].map(([module, items]) => (
                          <div key={module}>
                            <p className="label-caps mb-1 text-[10px]">{module}</p>
                            <div className="flex max-w-3xl flex-wrap gap-1">
                              {items.map((permission) => (
                                <span
                                  key={permission.id}
                                  title={permission.code}
                                  className="rounded-sm border bg-background px-1.5 py-0.5 text-[11px]"
                                >
                                  {permission.description || permission.action}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {users.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Nenhum</span>
                    ) : (
                      <div className="flex max-w-72 flex-wrap gap-1">
                        {users.map((profile) => (
                          <span
                            key={profile.id}
                            className="rounded-sm border px-1.5 py-0.5 text-[11px]"
                          >
                            {profile.display_name || profile.email || profile.id}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-64 flex-wrap gap-1">
                      {scopes.length === 0 ? (
                        <span className="text-xs text-muted-foreground">Sem atribuição ativa</span>
                      ) : (
                        scopes.map((scope) => (
                          <UnitTag key={scope ?? "global"}>
                            {scope === null
                              ? "Global"
                              : (data.businessUnits.find((unit) => unit.code === scope)?.name ??
                                scope)}
                          </UnitTag>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
