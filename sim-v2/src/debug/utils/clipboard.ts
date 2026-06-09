export function copyText(text: string, successMessage: string) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => console.log(successMessage),
      () => console.log(text),
    )
  } else {
    console.log(text)
  }
}
