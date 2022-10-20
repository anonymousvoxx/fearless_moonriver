import { UnknownVersionError } from '../../../common/errors'
import { encodeId } from '../../../common/tools'
import {HistoryElement, Round, RoundCollator} from '../../../model'
import { ParachainStakingDelegationRevokedEvent } from '../../../types/generated/events'
import { EventContext, EventHandlerContext } from '../../types/contexts'
import {createStaker, getOrCreateStaker} from "../../util/entities";

interface EventData {
    account: Uint8Array
    amount: bigint
    candidate: Uint8Array
}

function getEventData(ctx: EventContext): EventData {
    const event = new ParachainStakingDelegationRevokedEvent(ctx)

    if (event.isV1001) {
        const [account, candidate, amount] = event.asV1001
        return {
            account,
            amount,
            candidate,
        }
    } else if (event.isV1300) {
        const { delegator: account, unstakedAmount: amount, candidate } = event.asV1300
        return {
            account,
            amount,
            candidate,
        }
    }
    throw new UnknownVersionError(event.constructor.name)
}

export async function handleDelegationRevoked(ctx: EventHandlerContext) {
    const data = getEventData(ctx)
    const accountId = encodeId(data.account)
    const round = await ctx.store.get(Round, { where: {}, order: { index: 'DESC' } })

    const staker = await getOrCreateStaker(ctx, accountId)
    if (!staker) {
        await createStaker(ctx, {
            stashId: accountId,
            activeBond: 0n,
            role: 'delegator'
        })
    }

    await ctx.store.insert(new HistoryElement({
        id: ctx.event.id,
        blockNumber: ctx.block.height,
        timestamp: new Date(ctx.block.timestamp),
        type: 1,
        round: round,
        amount: data.amount,
        staker: staker,
    }))

    if (round && staker) {
        const collatorRound = await ctx.store.get(RoundCollator, {where: {id: `${round?.index}-${staker?.stashId}`}})
        if (collatorRound) {
            collatorRound.totalBond = collatorRound.totalBond - data.amount
            collatorRound.round = round
            await ctx.store.save(collatorRound)
        }
    }
}
