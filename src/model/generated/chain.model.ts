import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Token} from "./_token"

@Entity_()
export class Chain {
  constructor(props?: Partial<Chain>) {
    Object.assign(this, props)
  }

  @PrimaryColumn_()
  id!: string

  @Column_("jsonb", {transformer: {to: obj => obj.toJSON(), from: obj => new Token(undefined, marshal.nonNull(obj))}, nullable: false})
  token!: Token

  @Column_("integer", {nullable: true})
  paraId!: number | undefined | null

  @Index_()
  @ManyToOne_(() => Chain, {nullable: true})
  relayChain!: Chain | undefined | null
}