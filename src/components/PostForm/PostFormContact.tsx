import LocationInput, { type LocationResult } from '../LocationInput/LocationInput'
import PostFormCard from './PostFormCard'
import PostFormField from './PostFormField'
import { postFormInput } from './postFormInput'

interface Props {
  name: string
  phone: string
  wechat: string
  onNameChange: (v: string) => void
  onPhoneChange: (v: string) => void
  onWechatChange: (v: string) => void
  nameError?: string
  phoneError?: string
  showLocation?: boolean
  onLocationChange?: (loc: LocationResult | null) => void
}

export default function PostFormContact({
  name, phone, wechat,
  onNameChange, onPhoneChange, onWechatChange,
  nameError, phoneError,
  showLocation = false, onLocationChange,
}: Props) {
  return (
    <PostFormCard title="联系方式">
      <PostFormField label="姓名" required error={nameError}>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="联系人姓名"
          className={postFormInput(!!nameError)}
        />
      </PostFormField>

      <PostFormField label="联系电话" required error={phoneError}>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="647-xxx-xxxx"
          className={postFormInput(!!phoneError)}
        />
      </PostFormField>

      <PostFormField label="微信号（选填）">
        <input
          value={wechat}
          onChange={(e) => onWechatChange(e.target.value)}
          placeholder="微信号"
          className={postFormInput(false)}
        />
      </PostFormField>

      {showLocation && onLocationChange && (
        <PostFormField label="所在位置（选填）">
          <LocationInput onChange={onLocationChange} />
        </PostFormField>
      )}
    </PostFormCard>
  )
}
