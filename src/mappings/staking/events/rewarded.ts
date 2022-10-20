import assert from 'assert'
import { UnknownVersionError } from '../../../common/errors'
import { encodeId } from '../../../common/tools'
import { Reward, Round, RoundCollator} from '../../../model'
import { ParachainStakingRewardedEvent } from '../../../types/generated/events'
import { CommonHandlerContext, EventContext, EventHandlerContext } from '../../types/contexts'
import { ActionData } from '../../types/data'
import { getMeta } from '../../util/actions'
import { RewardPaymentDelay } from '../../util/consts'
import { getOrCreateStaker } from '../../util/entities'

interface EventData {
    amount: bigint
    account: Uint8Array
}

function getEventData(ctx: EventContext): EventData {
    const event = new ParachainStakingRewardedEvent(ctx)

    if (event.isV900) {
        const [account, amount] = event.asV900
        return {
            account,
            amount,
        }
    } else if (event.isV1300) {
        const { account, rewards: amount } = event.asV1300
        return {
            account,
            amount,
        }
    } else {
        throw new UnknownVersionError(event.constructor.name)
    }
}

export async function handleRewarded(ctx: EventHandlerContext) {
    const data = getEventData(ctx)

    await saveReward(ctx, {
        id: ctx.event.id,
        blockNumber: ctx.block.height,
        timestamp: new Date(ctx.block.timestamp),
        extrinsicHash: ctx.event.extrinsic?.hash,
        accountId: encodeId(data.account),
        amount: data.amount,
    })
}

export interface RewardData extends ActionData {
    amount: bigint
    accountId: string
}

export async function saveReward(ctx: CommonHandlerContext, data: RewardData) {
    const staker = await getOrCreateStaker(ctx, data.accountId)
    assert (staker != null)
    if (staker != null && staker?.role === 'collator') {
        staker.totalReward += data.amount

        await ctx.store.save(staker)

        const round = await ctx.store.get(Round, { where: {}, order: { index: 'DESC' } })
        assert(round != null)

        const collatorRound = await ctx.store.get(RoundCollator, {
            where: {id: `${round.index-2}-${staker.stashId}` }})
        if (collatorRound != null) {
            if (collatorRound.selfBond && collatorRound.totalBond != null && collatorRound.totalBond > 0) {
                const colStakeShare = collatorRound.selfBond / collatorRound.totalBond
                const amountDue = Number(data.amount) / (0.2 + 0.5 * Number(colStakeShare))
                const colRew = 0.2 * amountDue + 0.5 * amountDue * Number(colStakeShare)
                const colAnnualRew = colRew * Number(1460)
                collatorRound.apr = colAnnualRew / Number(collatorRound.selfBond)
                collatorRound.round = round
                    await ctx.store.save(collatorRound)
                const collatorLastRound = await ctx.store.get(RoundCollator, {
                    where: {id: `${round.index-6}-${staker.stashId}` }
                })
                ctx.log.info(`${round.index-6}-${staker.stashId} collatorRound.apr ${collatorRound.apr}`)
                ctx.log.info(`${round.index-6}-${staker.stashId} collatorLastRound?.apr ${collatorLastRound?.apr}`)
                ctx.log.info(`${round.index-6}-${staker.stashId} staker.apr24h ${staker.apr24h}`)
                if (collatorLastRound?.apr) {
                    const Apr = staker.apr24h || 0
                    const lastApr = collatorLastRound?.apr || 0
                    const avgApr = Apr * 4
                    if (lastApr > 0) {
                        staker.apr24h = (avgApr - lastApr + collatorRound.apr) / 4
                        ctx.log.info(`${round.index-6}-${staker.stashId} apr24h: ${staker.apr24h} marker ${4}`)
                    }
                    else {
                        const collatorLastRound3 = await ctx.store.get(RoundCollator, {
                            where: {id: `${round.index-5}-${staker.stashId}` }})
                        const collatorLastRound3Apr = collatorLastRound3?.apr || 0
                        const collatorLastRound2 = await ctx.store.get(RoundCollator, {
                            where: {id: `${round.index-4}-${staker.stashId}` }})
                        const collatorLastRound2Apr = collatorLastRound2?.apr || 0
                        const collatorLastRound1 = await ctx.store.get(RoundCollator, {
                            where: {id: `${round.index-3}-${staker.stashId}` }})
                        const collatorLastRound1Apr = collatorLastRound1?.apr || 0
                        staker.apr24h = (
                            collatorLastRound3Apr + collatorLastRound2Apr + collatorLastRound1Apr + collatorRound.apr
                        ) / 4
                        ctx.log.info(`${round.index-6}-${staker.stashId} apr24h: ${staker.apr24h} marker ${2}`)
                    }
                }
                else {
                    staker.apr24h = (collatorRound.apr) / 4
                    ctx.log.info(`apr24h: ${staker.apr24h} marker ${3}`)
                }
                await ctx.store.save(staker)

            }


            await ctx.store.insert(
                new Reward({
                    ...getMeta(data),
                    account: staker.stash,
                    amount: data.amount,
                    round: Math.min((round?.index || 0) - RewardPaymentDelay, 0),
                    staker,
                })
            )
        }
    }
}
