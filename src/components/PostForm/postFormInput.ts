export const postFormInput = (hasError: boolean) =>
  `w-full border rounded-xl px-3 py-2.5 text-sm outline-none transition-all
   ${hasError
     ? 'border-red-300 focus:ring-2 focus:ring-red-200'
     : 'border-gray-200 focus:ring-2 focus:ring-primary-300 focus:border-transparent'
   }`
