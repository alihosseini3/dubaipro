'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

type Rule = {
  eventType: string;
  channel: 'EMAIL' | 'WHATSAPP';
  locale: string;
  enabled: boolean;
  subject: string | null;
  body: string;
  isOverride: boolean;
};

export function AutomationManager({ locale: _locale }: { locale: string }) {
  const t = useTranslations('admin.automation');
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/automation', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as { data: Rule[] };
      setRules(json.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  }

  async function save(rule: Rule) {
    const key = keyOf(rule);
    setSaving(key);
    setError(null);
    try {
      const res = await fetch('/api/admin/automation', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: rule.eventType,
          channel: rule.channel,
          locale: rule.locale,
          enabled: rule.enabled,
          subject: rule.subject ?? null,
          body: rule.body
        })
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `status ${res.status}`);
      }
      setRules((rs) =>
        rs.map((r) => (keyOf(r) === key ? { ...r, isOverride: true } : r))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(null);
    }
  }

  const grouped = useMemo(() => {
    const out: Record<string, Rule[]> = {};
    for (const r of rules) {
      (out[r.eventType] ??= []).push(r);
    }
    return out;
  }, [rules]);

  if (loading) {
    return <div className="text-sm text-slate-500">{t('loading')}</div>;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
        {t('helpVars')}
      </div>

      {Object.entries(grouped).map(([event, list]) => (
        <section key={event} className="rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">{event}</h2>
            <p className="text-xs text-slate-500">{t(`events.${event}`)}</p>
          </header>
          <ul className="divide-y divide-slate-100">
            {list.map((r) => {
              const key = keyOf(r);
              const isActive = activeKey === key;
              return (
                <li key={key} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {r.channel}
                      </span>
                      <span className="text-xs uppercase text-slate-500">
                        {r.locale}
                      </span>
                      {r.isOverride && (
                        <span className="text-xs text-emerald-600">{t('overridden')}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={r.enabled}
                          onChange={(e) =>
                            setRules((rs) =>
                              rs.map((x) =>
                                keyOf(x) === key
                                  ? { ...x, enabled: e.target.checked }
                                  : x
                              )
                            )
                          }
                        />
                        {t('enabled')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveKey(isActive ? null : key)}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {isActive ? t('close') : t('edit')}
                      </button>
                    </div>
                  </div>

                  {isActive && (
                    <div className="mt-3 space-y-3">
                      {r.channel === 'EMAIL' && (
                        <div>
                          <label className="mb-1 block text-xs font-medium text-slate-700">
                            {t('subject')}
                          </label>
                          <input
                            type="text"
                            maxLength={200}
                            value={r.subject ?? ''}
                            onChange={(e) =>
                              setRules((rs) =>
                                rs.map((x) =>
                                  keyOf(x) === key
                                    ? { ...x, subject: e.target.value }
                                    : x
                                )
                              )
                            }
                            className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-700">
                          {t('body')}
                        </label>
                        <textarea
                          rows={6}
                          maxLength={10000}
                          value={r.body}
                          onChange={(e) =>
                            setRules((rs) =>
                              rs.map((x) =>
                                keyOf(x) === key
                                  ? { ...x, body: e.target.value }
                                  : x
                              )
                            )
                          }
                          className="block w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={saving === key}
                          onClick={() => save(r)}
                          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {saving === key ? t('saving') : t('save')}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function keyOf(r: Rule): string {
  return `${r.eventType}:${r.channel}:${r.locale}`;
}
