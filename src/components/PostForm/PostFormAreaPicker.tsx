const GTA_AREAS = [
  '多伦多市区', '北约克', '士嘉堡', '密西沙加', '万锦',
  '列治文山', '奥克维尔', '宾顿', '安省其他',
]

interface Props {
  selected: string[]
  onChange: (areas: string[]) => void
  error?: string
}

export { GTA_AREAS }

export default function PostFormAreaPicker({ selected, onChange, error }: Props) {
  const toggle = (a: string) =>
    onChange(selected.includes(a) ? selected.filter(x => x !== a) : [...selected, a])

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {GTA_AREAS.map((a) => (
          <button key={a} type="button" onClick={() => toggle(a)}
            className={`text-sm px-3 py-1.5 rounded-xl border transition-colors ${
              selected.includes(a)
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
            }`}
          >
            {a}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <p className="text-xs text-gray-400 mt-1.5">已选：{selected.join('、')}</p>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
