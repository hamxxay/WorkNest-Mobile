import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Header } from "../components/Header";
import { Screen } from "../components/Screen";
import { colors, radii } from "../theme";
import { getUsersPage, type AdminUser } from "../services/adminService";

const PAGE_SIZE = 20;

function normalizeRoles(roles: AdminUser["roles"] | string | undefined): string {
  if (Array.isArray(roles)) {
    return roles.join(", ");
  }
  if (typeof roles === "string") {
    return roles;
  }
  return "User";
}

export default function AdminUsersScreen({ embedded = false }: { embedded?: boolean }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);

  const loadUsers = useCallback(
    async (targetPage: number, targetSearch: string, append: boolean) => {
      const response = await getUsersPage({
        page: targetPage,
        limit: PAGE_SIZE,
        search: targetSearch || undefined,
      });
      setTotal(response.total);
      setUsers((prev) => (append ? [...prev, ...response.items] : response.items));
      setPage(targetPage);
      setError("");
    },
    []
  );

  useEffect(() => {
    setLoading(true);
    loadUsers(1, searchQuery, false)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unable to load users.";
        setError(message);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [loadUsers, searchQuery]);

  const hasMore =
    total == null ? users.length >= page * PAGE_SIZE : users.length < total;

  const handleSearch = () => {
    setSearchQuery(searchInput.trim());
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) {
      return;
    }

    const nextPage = page + 1;
    setLoadingMore(true);
    loadUsers(nextPage, searchQuery, true)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Unable to load more users.";
        setError(message);
      })
      .finally(() => setLoadingMore(false));
  };

  const body = (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {!embedded ? <Header /> : null}

      {!embedded ? <Text style={styles.title}>Admin Users Panel</Text> : null}
      {!embedded ? (
        <Text style={styles.subtitle}>Review account roles and access state.</Text>
      ) : null}

      <View style={styles.searchRow}>
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search by name or email"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={styles.searchInput}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Pressable onPress={handleSearch} style={styles.searchButton}>
          <Text style={styles.searchButtonText}>Search</Text>
        </Pressable>
      </View>

      {loading ? <Text style={styles.helper}>Loading users...</Text> : null}
      {!loading && !!error ? <Text style={styles.errorText}>{error}</Text> : null}
      {!loading && users.length === 0 ? <Text style={styles.helper}>No users found.</Text> : null}

      <View style={styles.list}>
        {users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <Text style={styles.userName}>
              {`${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email || user.id}
            </Text>
            <Text style={styles.userMeta}>{user.email ?? "-"}</Text>
            <Text style={styles.userMeta}>Roles: {normalizeRoles(user.roles)}</Text>
            <Text style={styles.statusText}>Status: {user.isActive === false ? "Inactive" : "Active"}</Text>
          </View>
        ))}
      </View>

      {!loading && hasMore ? (
        <Pressable style={styles.moreButton} onPress={handleLoadMore} disabled={loadingMore}>
          <Text style={styles.moreButtonText}>
            {loadingMore ? "Loading..." : "Load More"}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );

  if (embedded) {
    return body;
  }

  return (
    <Screen>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, paddingBottom: 28 },
  title: { color: colors.foreground, fontSize: 28, fontWeight: "800", marginBottom: 6 },
  subtitle: { color: colors.mutedForeground, fontSize: 15, marginBottom: 18 },
  searchRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.foreground,
    backgroundColor: colors.muted,
  },
  searchButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  searchButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  helper: { color: colors.mutedForeground, fontSize: 13, marginBottom: 8 },
  errorText: { color: "#dc2626", fontSize: 13, marginBottom: 8, fontWeight: "600" },
  list: { gap: 12 },
  userCard: {
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 4,
  },
  userName: { color: colors.foreground, fontSize: 17, fontWeight: "700" },
  userMeta: { color: colors.mutedForeground, fontSize: 13 },
  statusText: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 3 },
  moreButton: {
    marginTop: 14,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  moreButtonText: { color: colors.foreground, fontSize: 13, fontWeight: "700" },
});
