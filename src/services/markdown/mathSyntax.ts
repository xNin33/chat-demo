import { math } from 'micromark-extension-llm-math'

const looksLikeInlineMath = (value: string) => {
  const body = value.trim()
  if (!body || /[\r\n`]|\*\*/.test(value)) {
    return false
  }
  if (/\\[a-z]+/i.test(body)) {
    return true
  }
  if (/^[a-z\p{Script=Greek}]{1,2}$|^[+-]?\d+(?:[.,]\d+)?$/iu.test(body)) {
    return true
  }
  // 普通词组、货币和句子保留给 Markdown；变量表达式可以继续用单美元符号。
  return (
    /^[\p{Script=Latin}\p{Script=Greek}\d\s.,()[\]{}=+\-*/_^|<>≤≥≠±×÷·∑∫∞→]+$/u.test(body) &&
    /[=+\-*/_^|<>()[\]≤≥≠±×÷·∑∫∞→]/u.test(body) &&
    !/[=+\-*/_^<>]$/.test(body) &&
    (body.match(/[a-z]{3,}/gi)?.length ?? 0) <= 1
  )
}

export const mathSyntax = (input: string): ReturnType<typeof math> => {
  const extension = math({ singleDollarTextMath: true })
  const dollar = extension.text?.[36]
  if (!dollar || Array.isArray(dollar)) {
    return extension
  }

  return {
    ...extension,
    text: {
      ...extension.text,
      36: {
        ...dollar,
        tokenize(effects, ok, nok) {
          const start = this.now().offset
          return dollar.tokenize.call(
            this,
            effects,
            (code) => {
              const end = this.now().offset
              const raw = input.slice(start, end)
              // 在分词阶段退回普通文本，使候选里的加粗等标记仍可正常解析。
              if (
                raw.startsWith('$$') ||
                (!/\d/.test(input.charAt(end)) && looksLikeInlineMath(raw.slice(1, -1)))
              ) {
                return ok(code)
              }
              return nok(code)
            },
            nok
          )
        },
      },
    },
  }
}
