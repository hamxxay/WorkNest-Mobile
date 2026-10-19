import { useCallback, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppHeader, AsyncList, Card, ListRow, StatusPill } from "../../../../components/ui";
import type { StaffStackParamList } from "../../../../navigation/staffTypes";
import { listCustomers, type StaffCustomer } from "../../../../services/staff";
import { useResponsive } from "../../../../utils/responsive";
import { ActiveFilterChips, ListFilterSheet, filteredEmpty, useListFilters } from "../shared/ListFilters";
import { SearchField } from "../shared/SearchField";
import { StaffScreen, useInTabs } from "../shared/StaffScreen";
import { useDebounced, usePagedList } from "../shared/hooks";

type Nav = NativeStackNavigationProp<StaffStackParamList>;
const PAGE_SIZE = 20;

/**
 * Customers (GET customer?page=&limit=&search=&locationId=&status=&from=&to=): newest first, search by name,
 * company, email, code or phone; filter by location, active / inactive and created date (on the server,
 * ../shared/ListFilters). Unfiltered the API sends no total, so more pages load while full pages come back.
 */
export default function CustomerListScreen() {
  const inTabs = useInTabs();
  const navigation = useNavigation<Nav>();
  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim());
  const filter = useListFilters("customers");
  const { filters } = filter;

  const fetchPage = useCallback(
    (page: number) => listCustomers({ page, limit: PAGE_SIZE, search, ...filters }),
    [search, filters],
  );
  const list = usePagedList(fetchPage);

  return (
    <StaffScreen>
      <AppHeader
        showBack={inTabs ? false : undefined}
        title="Customers"
        subtitle={filter.active && list.total ? `${list.total} found` : undefined}
        actions={[
          filter.headerAction,
          { icon: "person-add-outline", accessibilityLabel: "New customer", onPress: () => navigation.navigate("CustomerForm") },
        ]}
      />
      <SearchField value={query} onChangeText={setQuery} placeholder="Search name, email, phone or code" />
      <ActiveFilterChips state={filter} />
      <AsyncList
        data={list.items}
        keyExtractor={(c) => String(c.id)}
        loading={list.loading}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        error={list.error}
        hasMore={list.hasMore}
        loadingMore={list.loadingMore}
        onEndReached={list.loadMore}
        gap={8}
        keyboardShouldPersistTaps="handled"
        empty={
          filteredEmpty(filter, "customers", search) ?? {
            illustration: search ? "search" : "people",
            title: search ? "No customers found" : "No customers yet",
            message: search ? `Nothing matches "${search}".` : "Add a customer to quote or book a space for them.",
            actionLabel: search ? undefined : "New customer",
            onAction: search ? undefined : () => navigation.navigate("CustomerForm"),
          }
        }
        renderItem={({ item }) => <CustomerRow customer={item} onPress={() => navigation.navigate("CustomerDetail", { customerId: item.id, customer: item })} />}
      />
      <ListFilterSheet state={filter} />
    </StaffScreen>
  );
}

function CustomerRow({ customer, onPress }: { customer: StaffCustomer; onPress: () => void }) {
  // An inactive customer on a phone: the code moves into the subtitle, so the code and the Inactive pill beside it
  // don't leave the name a few letters wide.
  const { isTablet } = useResponsive();
  const codeBeside = isTablet || customer.isActive;
  const subtitle = [codeBeside ? null : customer.code, customer.company, customer.email, customer.phoneNumber].filter(Boolean).join(" · ");
  return (
    <Card padding={0}>
      <ListRow
        avatar={{ name: customer.fullName || customer.email }}
        title={customer.fullName || customer.email}
        subtitle={subtitle}
        meta={codeBeside ? customer.code || undefined : undefined}
        right={customer.isActive ? undefined : <StatusPill status="Inactive" />}
        onPress={onPress}
      />
    </Card>
  );
}
