import {
    ActionExample,
    Content,
    HandlerCallback,
    IAgentRuntime,
    Memory,
    ModelClass,
    ServiceType,
    State,
    composeContext,
    elizaLogger,
    generateObject,
    type Action,
} from "@elizaos/core";
import { z } from "zod";

import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_DECIMALS } from "@mysten/sui/utils";

import suilendsdk from '@suilend/sdk';
console.log(suilendsdk);
//const { initializeSuilend, initializeSuilendRewards, initializeObligations } = suilendsdk;
const { initializeSuilend, initializeSuilendRewards, createObligationIfNoneExists, sendObligationToUser } = suilendsdk;

import {
  LENDING_MARKET_ID,
	LENDING_MARKET_TYPE,
	SuilendClient,
} from "@suilend/sdk/client";

import { walletProvider } from "../providers/wallet";
import { parseAccount, SuiNetwork } from "../utils";
import { SuiService } from "../services/sui";

export interface SuilendDepositContent extends Content {
    amount: string | number;
}

function isDepositContent(content: Content): content is SuilendDepositContent {
    console.log("Content for suilend deposit", content);
    return (
        (typeof content.amount === "string" || typeof content.amount === "number")
    );
}

const depositTemplate = `Respond with a JSON markdown block containing only the extracted values. Use null for any values that cannot be determined.

Example response:
\`\`\`json
{
    "amount": "1"
}
\`\`\`

{{recentMessages}}

Given the recent messages, extract the following information about the requested token deposit:
- Amount to deposit

Respond with a JSON markdown block containing only the extracted values.`;

const initializeObligations = async (
  suiClient: SuiClient,
  suilendClient: SuilendClient,
  refreshedRawReserves: Reserve<string>[],
  reserveMap: Record<string, ParsedReserve>,
  address?: string,
) => {
  if (!address) return { obligationOwnerCaps: [], obligations: [] };

  const obligationOwnerCaps = await SuilendClient.getObligationOwnerCaps(
    address,
    suilendClient.lendingMarket.$typeArgs,
    suiClient,
  );

  const obligations = (
    await Promise.all(
      obligationOwnerCaps.map((ownerCap) =>
        SuilendClient.getObligation(
					ownerCap.obligationId,
          suilendClient.lendingMarket.$typeArgs,
          suiClient,
				),
			),
    )
  )
	.map((rawObligation) =>
		simulate.refreshObligation(rawObligation, refreshedRawReserves),
	)
	.map((refreshedObligation) =>
		parseObligation(refreshedObligation, reserveMap),
	)
	.sort((a, b) => +b.netValueUsd.minus(a.netValueUsd));

  return { obligationOwnerCaps, obligations };
};

export default {
    name: "DEPOSIT_TO_SUILEND",
    similes: [
        "DEPOSIT_TOKEN",
        "DEPOSIT",
    ],
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        console.log("Validating sui deposit from user:", message.userId);
        //add custom validate logic here
        /*
            const adminIds = runtime.getSetting("ADMIN_USER_IDS")?.split(",") || [];
            //console.log("Admin IDs from settings:", adminIds);

            const isAdmin = adminIds.includes(message.userId);

            if (isAdmin) {
                //console.log(`Authorized deposit from user: ${message.userId}`);
                return true;
            }
            else
            {
                //console.log(`Unauthorized deposit attempt from user: ${message.userId}`);
                return false;
            }
            */
        return true;
    },
    description: "deposit SUI token from the agent's wallet to suilend",
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state: State,
        _options: { [key: string]: unknown },
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting DEPOSIT_TO_SUILEND handler...");

        const walletInfo = await walletProvider.get(runtime, message, state);
        state.walletInfo = walletInfo;

        // Initialize or update state
        if (!state) {
            state = (await runtime.composeState(message)) as State;
        } else {
            state = await runtime.updateRecentMessageState(state);
        }

        // Define the schema for the expected output
        const depositSchema = z.object({
            amount: z.union([z.string(), z.number()]),
        });

        // Compose deposit context
        const depositContext = composeContext({
            state,
            template: depositTemplate,
        });

        // Generate deposit content with the schema
        const content = await generateObject({
            runtime,
            context: depositContext,
            schema: depositSchema,
            modelClass: ModelClass.SMALL,
        });

        const depositContent = content.object as DepositContent;

        // Validate deposit content
        if (!isDepositContent(depositContent)) {
            console.error("Invalid content for DEPOSIT_TO_SUILEND action.");
            if (callback) {
                callback({
                    text: "Unable to process deposit request. Invalid content provided.",
                    content: { error: "Invalid deposit content" },
                });
            }
            return false;
        }

        try {
            const suiAccount = parseAccount(runtime);
            const network = runtime.getSetting("SUI_NETWORK");
            const suiClient = new SuiClient({
                url: getFullnodeUrl(network as SuiNetwork),
            });
            const adjustedAmount = BigInt(
                Number(depositContent.amount) * Math.pow(10, SUI_DECIMALS)
            );
            console.log(
                `Depositring: ${depositContent.amount} tokens (${adjustedAmount} base units)`
            );
            // TODO change the logic to Suilend
            const tx = new Transaction();
						const suiService = runtime.getService<SuiService>(
								ServiceType.TRANSCRIPTION
						);
						const address = suiService.getAddress();
						const suilendClient = await SuilendClient.initialize(
							LENDING_MARKET_ID,
							LENDING_MARKET_TYPE,
							suiClient,
						);
						const {
							lendingMarket,
							coinMetadataMap,

							reserveMap,
							refreshedRawReserves,
							reserveCoinTypes,
							reserveCoinMetadataMap,

							rewardCoinTypes,
							activeRewardCoinTypes,
							rewardCoinMetadataMap,
						} = await initializeSuilend(suiClient, suilendClient);
//						console.log(lendingMarket.reserves);
/*						const { obligationOwnerCaps, obligations } = await initializeObligations(
							suiClient,
							suilendClient,
							refreshedRawReserves,
							reserveMap,
							address,
						);
*/
						const coinType = "0x2::sui::SUI";
						const obligationOwnerCaps = await SuilendClient.getObligationOwnerCaps(
							address,
							suilendClient.lendingMarket.$typeArgs,
							suiClient,
						);
console.log("obligationOwnerCaps", obligationOwnerCaps);
/*
						const obligationOwnerCap = obligationOwnerCaps.find(
							(cap) => cap.obligationId === obligation?.id
						);
*/
						const obligationOwnerCap = obligationOwnerCaps.length > 0 ? obligationOwnerCaps[0] : undefined;
console.log("obligationOwnerCap", obligationOwnerCap);

						try {
							const { obligationOwnerCapId, didCreate } =
								createObligationIfNoneExists(
									suilendClient,
									tx,
									obligationOwnerCap,
								);
console.log("obligationOwnerCapId", obligationOwnerCapId);
console.log("didCreate", didCreate);
							await suilendClient.depositIntoObligation(
								address,
								coinType,
								adjustedAmount,
								tx,
								obligationOwnerCapId,
							);
							if (didCreate)
								sendObligationToUser(obligationOwnerCapId, address, tx);
						} catch (err) {
							console.error(err);
							throw err;
						}

/*
            const [coin] = tx.splitCoins(tx.gas, [adjustedAmount]);
            tx.depositObjects([coin], depositContent.recipient);
            const executedTransaction =
                await suiClient.signAndExecuteTransaction({
                    signer: suiAccount,
                    transaction: tx,
                });
*/
						const executedTx = await suiClient.signAndExecuteTransaction({
								signer: suiAccount,
								transaction: tx,
						});

            console.log("Deposit successful:", executedTx.digest);

            if (callback) {
                const txLink = await suiService.getTransactionLink(
                    executedTx.digest
                );
                callback({
                    text: `Successfully depositred ${depositContent.amount} SUI to Suilend, Transaction: ${txLink}`,
                    content: {
                        success: true,
                        hash: executedTx.digest,
                        amount: depositContent.amount
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during token deposit:", error);
            if (callback) {
                callback({
                    text: `Error depositring tokens: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },

    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Deposit 1 SUI tokens to Suilend",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "I'll deposit 1 SUI tokens now...",
                    action: "DEPOSIT_TO_SUILEND",
                },
            },
            {
                user: "{{user2}}",
                content: {
                    text: "Successfully deposit 1 SUI tokens to Suilend, Transaction: 0x39a8c432d9bdad993a33cc1faf2e9b58fb7dd940c0425f1d6db3997e4b4b05c0",
                },
            },
        ],
    ] as ActionExample[][],
} as Action;
