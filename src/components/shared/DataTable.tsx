// Client-side "DataTables"-style table (AdminLTE's DataTables look — show
// entries, search, sortable headers, pagination, optional bulk-select)
// built on react-bootstrap's Table. Wrapped in .table-responsive and sized
// for touch (36px+ controls) so it stays usable on a tablet. For
// server-paginated data, pass `serverPagination` and it renders just the
// pager against the API's count instead of slicing locally.
import { useMemo, useState, type ReactNode } from "react";
import { Form, Pagination, Table } from "react-bootstrap";
import { useTranslation } from "react-i18next";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  /** Value used for sorting and text search; omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  className?: string;
}

interface ServerPagination {
  page: number;
  pageSize: number;
  count: number;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Show the search box / page-size select (client-side mode). */
  toolbar?: boolean;
  initialPageSize?: number;
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  isRowSelectable?: (row: T) => boolean;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  empty?: ReactNode;
  footer?: ReactNode;
  serverPagination?: ServerPagination;
  isLoading?: boolean;
}

const PAGE_SIZES = [10, 25, 50, 100];

function pageItems(page: number, pageCount: number): (number | "gap")[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ["gap" as const, p] : [p]));
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  toolbar = true,
  initialPageSize = 25,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  isRowSelectable = () => true,
  onRowClick,
  rowClassName,
  empty,
  footer,
  serverPagination,
  isLoading,
}: DataTableProps<T>) {
  const { t } = useTranslation("backoffice");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const processed = useMemo(() => {
    let result = rows;
    if (!serverPagination && search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((row) =>
        columns.some((c) => c.sortValue && String(c.sortValue(row)).toLowerCase().includes(term))
      );
    }
    const sortColumn = sort && columns.find((c) => c.key === sort.key);
    if (sort && sortColumn?.sortValue) {
      const value = sortColumn.sortValue;
      result = [...result].sort((a, b) => {
        const av = value(a);
        const bv = value(b);
        return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * sort.dir;
      });
    }
    return result;
  }, [rows, columns, search, sort, serverPagination]);

  const effectivePage = serverPagination ? serverPagination.page : page;
  const effectivePageSize = serverPagination ? serverPagination.pageSize : pageSize;
  const total = serverPagination ? serverPagination.count : processed.length;
  const pageCount = Math.max(1, Math.ceil(total / effectivePageSize));
  const currentPage = Math.min(effectivePage, pageCount);
  const visible = serverPagination
    ? processed
    : processed.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const selectableVisible = visible.filter(isRowSelectable).map(rowKey);
  const allSelected = selectableVisible.length > 0 && selectableVisible.every((key) => selectedKeys.includes(key));

  function goTo(next: number) {
    if (serverPagination) serverPagination.onPageChange(next);
    else setPage(next);
  }

  function toggleSort(key: string) {
    setSort((current) => (current?.key === key ? { key, dir: current.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function toggleAll() {
    if (!onSelectionChange) return;
    onSelectionChange(
      allSelected
        ? selectedKeys.filter((key) => !selectableVisible.includes(key))
        : [...new Set([...selectedKeys, ...selectableVisible])]
    );
  }

  function toggleRow(key: string) {
    if (!onSelectionChange) return;
    onSelectionChange(selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]);
  }

  const first = total === 0 ? 0 : (currentPage - 1) * effectivePageSize + 1;
  const last = Math.min(currentPage * effectivePageSize, total);

  return (
    <div>
      {toolbar && !serverPagination && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
          <label className="d-flex align-items-center gap-2 small mb-0">
            {t("table.show")}
            <Form.Select
              size="sm"
              style={{ width: "auto" }}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Form.Select>
            {t("table.entries")}
          </label>
          <Form.Control
            type="search"
            size="sm"
            style={{ maxWidth: 260 }}
            placeholder={t("table.search")}
            aria-label={t("table.search")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      <div className="table-responsive">
        <Table hover className="bbms-table">
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 44 }}>
                  <Form.Check
                    aria-label={t("table.select_all")}
                    checked={allSelected}
                    disabled={selectableVisible.length === 0}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`${column.className ?? ""}${column.sortValue ? " is-sortable" : ""}`}
                  onClick={column.sortValue ? () => toggleSort(column.key) : undefined}
                  aria-sort={sort?.key === column.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                >
                  {column.header}
                  {column.sortValue && (
                    <i
                      className={`ms-1 fas ${sort?.key === column.key ? (sort.dir === 1 ? "fa-sort-up" : "fa-sort-down") : "fa-sort text-black-50"}`}
                      aria-hidden="true"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center text-muted py-4">
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  {t("table.loading")}
                </td>
              </tr>
            )}
            {!isLoading && visible.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center text-muted py-4">
                  {empty ?? t("table.empty")}
                </td>
              </tr>
            )}
            {!isLoading &&
              visible.map((row) => {
                const key = rowKey(row);
                const selected = selectedKeys.includes(key);
                return (
                  <tr
                    key={key}
                    className={`${selected ? "is-selected " : ""}${rowClassName?.(row) ?? ""}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    style={onRowClick ? { cursor: "pointer" } : undefined}
                  >
                    {selectable && (
                      <td onClick={(event) => event.stopPropagation()}>
                        <Form.Check
                          aria-label={t("table.select_row")}
                          checked={selected}
                          disabled={!isRowSelectable(row)}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td key={column.key} className={column.className}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
          {footer && <tfoot>{footer}</tfoot>}
        </Table>
      </div>
      {total > 0 && (
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-2">
          <span className="small text-muted">{t("table.showing", { first, last, total })}</span>
          {pageCount > 1 && (
            <Pagination size="sm" className="mb-0">
              <Pagination.Prev disabled={currentPage === 1} onClick={() => goTo(currentPage - 1)} />
              {pageItems(currentPage, pageCount).map((item, index) =>
                item === "gap" ? (
                  <Pagination.Ellipsis key={`gap-${index}`} disabled />
                ) : (
                  <Pagination.Item key={item} active={item === currentPage} onClick={() => goTo(item)}>
                    {item}
                  </Pagination.Item>
                )
              )}
              <Pagination.Next disabled={currentPage === pageCount} onClick={() => goTo(currentPage + 1)} />
            </Pagination>
          )}
        </div>
      )}
    </div>
  );
}
