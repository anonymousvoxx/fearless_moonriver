import { UnknownVersionError } from '../../../common/errors'
import { decodeId, encodeId } from '../../../common/tools'
import { ParachainStakingNominatorState2Storage } from '../../../types/generated/storage'
import { BlockContext } from '../../../types/generated/support'

interface StorageData {
    nominations: {
        owner: Uint8Array
        amount: bigint
    }[]
    total: bigint
}

async function getStorageData(
    ctx: BlockContext,
    accounts: Uint8Array[]
): Promise<(StorageData | undefined)[] | undefined> {
    const storage = new ParachainStakingNominatorState2Storage(ctx)
    if (!storage.isExists) return undefined

    if (storage.isV900) {
        return await storage.getManyAsV900(accounts)
    } else {
        throw new UnknownVersionError(storage.constructor.name)
    }
}

interface NominatorState {
    id: string
    bond: bigint
    nominations: {
        id: string
        amount: bigint
    }[]
}

async function queryStorageFunction(
    ctx: BlockContext,
    accounts: string[]
): Promise<(NominatorState | undefined)[] | undefined> {
    if (accounts.length === 0) return []

    const u8 = accounts.map((a) => decodeId(a))

    const data = await getStorageData(ctx, u8)
    if (!data) return undefined

    return data.map((d, i) =>
        d != null
            ? {
                  id: accounts[i],
                  bond: d.total,
                  nominations: d.nominations.map((nomination) => ({
                      id: encodeId(nomination.owner),
                      amount: nomination.amount,
                  })),
              }
            : undefined
    )
}

export async function getNominatorState(ctx: BlockContext, account: string): Promise<NominatorState | undefined>
export async function getNominatorState(
    ctx: BlockContext,
    accounts: string[]
): Promise<(NominatorState | undefined)[] | undefined>
export async function getNominatorState(ctx: BlockContext, accountOrAccounts: string | string[]) {
    if (Array.isArray(accountOrAccounts)) {
        return await queryStorageFunction(ctx, accountOrAccounts)
    } else {
        return (await queryStorageFunction(ctx, [accountOrAccounts]))?.[0]
    }
}
