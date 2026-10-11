'use client'

// Embeds the OpenClaw audit trail viewer (served by the separate openclaw-audit
// service over HTTPS and proxied through /audit-proxy). The audit service enforces
// its own login; use "Login settings" inside the viewer to change the credentials.
export default function AuditDashboard() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Independent, hash-chained record of everything the agents do. Sign in with the audit
          credentials; change them via <b>Login settings</b> in the viewer.
        </span>
        <a
          href="/audit-proxy/"
          target="_blank"
          rel="noreferrer"
          className="text-cyan-400 hover:text-cyan-300 whitespace-nowrap ml-4"
        >
          Open in new tab ↗
        </a>
      </div>
      <iframe
        src="/audit-proxy/"
        title="OpenClaw Audit Trail"
        className="w-full rounded-lg border border-gray-700/50 bg-black"
        style={{ height: '78vh' }}
      />
    </div>
  )
}
