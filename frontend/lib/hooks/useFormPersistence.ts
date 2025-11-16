import { useEffect, useRef } from "react";
import type { UseFormReturn, FieldValues } from "react-hook-form";

export function useFormPersistence<T extends FieldValues = FieldValues>(
  key: string,
  methods: UseFormReturn<T>,
  options?: { debounceMs?: number; restore?: boolean }
) {
  const { watch, reset } = methods;
  const debounceMs = options?.debounceMs ?? 400;
  const restore = options?.restore ?? true;
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!restore) return;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);

      reset(parsed as T); // ✅ clean & safe
    } catch (err) {
      console.warn("[useFormPersistence] failed to restore", err);
    }
  }, [key, reset]);

  useEffect(() => {
    const subscription = watch((value) => {
      if (timerRef.current) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
          console.warn("[useFormPersistence] failed to save", err);
        }
      }, debounceMs);
    });

    return () => {
      subscription.unsubscribe();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [watch, key, debounceMs]);

  const clear = () => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn("[useFormPersistence] failed to clear", err);
    }
  };

  return { clear };
}

export default useFormPersistence;
