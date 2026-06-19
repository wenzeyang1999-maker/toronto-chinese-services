export default function PostFormField({
  label, required, error, className = '', children,
}: {
  label: string; required?: boolean; error?: string; className?: string; children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
