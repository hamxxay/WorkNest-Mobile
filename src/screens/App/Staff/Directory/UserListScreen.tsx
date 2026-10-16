import { useCallback, useState } from "react";
import { AppHeader, AsyncList, Card, ListRow, StatusPill } from "../../../../components/ui";
import { normalizeRoleName, roleLabel } from "../../../../context/roles";
import { listUsers, type StaffUser } from "../../../../services/staff";
import { useResponsive } from "../../../../utils/responsive";
import { SearchField } from "../shared/SearchField";
import { StaffScreen } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

const PAGE_SIZE = 20;

/** Users, read-only (GET user?page=&limit=&search=): admins see the users of their locations. */
export default function UserListScreen() {
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const fetchPage = useCallback((page: number) => listUsers({ page, limit: PAGE_SIZE, search }), [search]);
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader title="Users" subtitle={list.total ? `${list.total} users` : undefined} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name or email" />
      <AsyncList
        data={list.items}
        keyExtractor={(u) => u.id || u.email}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={{ illustration: search ? "search" : "people", title: search ? "No users found" : "No users" }}
        renderItem={({ item }) => <UserRow user={item} />}
      />
    </StaffScreen>
  );
}

function UserRow({ user }: { user: StaffUser }) {
  const role = normalizeRoleName(user.role) ?? "general";
  // Name and role as stored in the database (WN_Users.Name, WN_Roles.DisplayName); the app's own role label only
  // when an older API sends no display name.
  const title = user.name || user.email;
  const label = user.roleDisplayName || roleLabel(role);
  const contact = [user.name ? user.email : null, user.phone].filter(Boolean).join(" · ");
  // Phones: the location goes on its own line under the contact details. Beside the role pill it would leave the
  // name a few letters wide; tablets have room for it on the right.
  const { isTablet } = useResponsive();
  const locationBeside = isTablet || !user.locationName;
  return (
    <Card padding={0}>
      <ListRow
        avatar={{ name: title }}
        title={title}
        subtitle={locationBeside ? contact : [contact, user.locationName].filter(Boolean).join("\n")}
        subtitleLines={locationBeside ? 2 : 3}
        meta={locationBeside ? user.locationName ?? undefined : undefined}
        right={user.isActive ? <StatusPill tone={role === "general" ? "neutral" : "primary"} label={label} /> : <StatusPill status="Inactive" />}
      />
    </Card>
  );
}
