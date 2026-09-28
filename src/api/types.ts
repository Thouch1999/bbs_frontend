// Mirrors apps.core.serializers.ErrorResponseSerializer /
// apps.core.exceptions.bbms_exception_handler on the backend — every BBMS
// endpoint returns this shape on error, so callers never branch on axios
// internals.
export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  status?: number;
}

export const UNKNOWN_API_ERROR: Omit<ApiError, "status"> = {
  code: "unknown_error",
  message: "Something went wrong. Please try again.",
};
