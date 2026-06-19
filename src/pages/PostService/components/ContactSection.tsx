import LocationInput, { type LocationResult } from '../../../components/LocationInput/LocationInput'
import Field from './Field'

interface Props {
  name: string
  phone: string
  wechat: string | undefined
  errors: { name?: string; phone?: string }
  onChange: (field: 'name' | 'phone' | 'wechat', value: string) => void
  onLocationChange: (loc: LocationResult | null) => void
  onProceed: () => void
}

export default function ContactSection({
  name, phone, wechat, errors, onChange, onLocationChange, onProceed,
}: Props) {
  return (
    <div className="card p-4 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">联系方式</h3>

      <Field label="联系人姓名" required error={errors.name}>
        <input
          className="input-base"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder="您的称呼"
        />
      </Field>

      <Field label="联系电话" required error={errors.phone}>
        <input
          className="input-base"
          value={phone}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="647-xxx-xxxx"
          type="tel"
        />
      </Field>

      <Field label="微信号（可选）">
        <input
          className="input-base"
          value={wechat ?? ''}
          onChange={(e) => onChange('wechat', e.target.value)}
          onBlur={onProceed}
          placeholder="您的微信号"
        />
      </Field>

      <Field label="所在位置（选填）">
        <LocationInput onChange={onLocationChange} />
        <p className="text-xs text-amber-600 mt-2">
          未定位时会显示服务区域，但不会出现在精确地图点位中。
        </p>
      </Field>
    </div>
  )
}
