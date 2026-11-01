export const PASSWORD_MIN_LENGTH = 4
export const PASSWORD_MAX_LENGTH = 128

export type PasswordOptions = {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

const CHARACTERS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/~",
} as const

function randomIndex(size: number) {
  const sample = new Uint32Array(1)
  // Reject the incomplete range so modulo does not favor some characters.
  const limit = 0x100000000 - (0x100000000 % size)
  do { crypto.getRandomValues(sample) } while (sample[0] >= limit)
  return sample[0] % size
}

export function generatePassword(options: PasswordOptions): string {
  if (!Number.isInteger(options.length) || options.length < PASSWORD_MIN_LENGTH || options.length > PASSWORD_MAX_LENGTH) {
    throw new Error(`Length must be ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters`)
  }
  const groups = (Object.keys(CHARACTERS) as (keyof typeof CHARACTERS)[])
    .filter((key) => options[key]).map((key) => CHARACTERS[key])
  if (!groups.length) throw new Error("Select at least one character type")

  const alphabet = groups.join("")
  const password = groups.map((group) => group[randomIndex(group.length)])
  while (password.length < options.length) password.push(alphabet[randomIndex(alphabet.length)])
  for (let index = password.length - 1; index > 0; index--) {
    const other = randomIndex(index + 1)
    ;[password[index], password[other]] = [password[other], password[index]]
  }
  return password.join("")
}
