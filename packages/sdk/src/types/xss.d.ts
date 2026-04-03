declare module 'xss' {
  export interface IFilterXSSOptions {
    whiteList?: Record<string, string[]>
    stripIgnoreTag?: boolean
    stripIgnoreTagBody?: string[]
    allowCommentTag?: boolean
    css?: boolean | Record<string, unknown>
  }

  export default function xss(
    html: string,
    options?: IFilterXSSOptions,
  ): string
}
