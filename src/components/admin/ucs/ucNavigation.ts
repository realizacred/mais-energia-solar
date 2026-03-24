export interface UcNavigationContext {
  tab?: string | null;
  subtab?: string | null;
  origin?: string | null;
  fromUcId?: string | null;
  fromUcName?: string | null;
  fromUcCode?: string | null;
  gdGroupId?: string | null;
  gdGroupName?: string | null;
  relatedUcId?: string | null;
  relatedUcName?: string | null;
  relatedUcCode?: string | null;
  returnTab?: string | null;
  returnSubtab?: string | null;
  beneficiaryId?: string | null;
  beneficiaryName?: string | null;
}

const QUERY_KEY_MAP: Record<keyof UcNavigationContext, string> = {
  tab: "tab",
  subtab: "subtab",
  origin: "origin",
  fromUcId: "from_uc_id",
  fromUcName: "from_uc_name",
  fromUcCode: "from_uc_code",
  gdGroupId: "gd_group_id",
  gdGroupName: "gd_group_name",
  relatedUcId: "related_uc_id",
  relatedUcName: "related_uc_name",
  relatedUcCode: "related_uc_code",
  returnTab: "return_tab",
  returnSubtab: "return_subtab",
  beneficiaryId: "beneficiary_id",
  beneficiaryName: "beneficiary_name",
};

const CONTEXT_KEYS = Object.keys(QUERY_KEY_MAP) as Array<keyof UcNavigationContext>;

function applyParam(
  params: URLSearchParams,
  key: keyof UcNavigationContext,
  value: string | null | undefined,
) {
  const queryKey = QUERY_KEY_MAP[key];
  if (!value) {
    params.delete(queryKey);
    return;
  }

  params.set(queryKey, value);
}

export function readUcNavigationContext(searchParams: URLSearchParams): UcNavigationContext {
  return CONTEXT_KEYS.reduce((acc, key) => {
    acc[key] = searchParams.get(QUERY_KEY_MAP[key]);
    return acc;
  }, {} as UcNavigationContext);
}

export function mergeUcSearchParams(
  current: URLSearchParams,
  updates: UcNavigationContext,
): URLSearchParams {
  const next = new URLSearchParams(current);
  CONTEXT_KEYS.forEach((key) => {
    if (key in updates) {
      applyParam(next, key, updates[key]);
    }
  });
  return next;
}

export function buildUcDetailPath(unitId: string, context: UcNavigationContext = {}) {
  const params = mergeUcSearchParams(new URLSearchParams(), context);
  const query = params.toString();
  return query ? `/admin/ucs/${unitId}?${query}` : `/admin/ucs/${unitId}`;
}
