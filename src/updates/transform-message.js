import { parseFwds } from './helpers';
import { CHAT_PEER } from '../util/constants';

/**
 * Special attachments in one message
 *
 * @type {Object}
 */
const specialAttachments = {
	sticker: raw => ({
		type: 'sticker',
		sticker: {
			id: Number(raw.attach1),
			product_id: Number(raw.attach1_product_id)
		}
	}),
	money_transfer: raw => ({
		type: 'money_transfer',
		money_transfer: {
			data: raw.attach1,
			amount: Number(raw.attach1_amount),
			currency: Number(raw.attach1_currency)
		}
	}),
	gift: raw => ({
		type: 'gift',
		gift: {
			id: Number(raw.attach1)
		}
	})
};

/**
 * Transform message to Object
 *
 * @param {Array} update
 *
 * @return {Object}
 */
// eslint-disable-next-line import/prefer-default-export
export default function transformMessage([, id, flags, peer, date, body, attachments, random]) {
	const message = {
		id,
		date,
		body,
		flags,
		geo: 'geo' in attachments
			? {}
			: null,
		random_id: random,
		out: Number((flags & 1) !== 0),
		deleted: Number((flags & 128) !== 0),
		read_state: Number((flags & 1) !== 0),
		emoji: Number(attachments.emoji === 1),

		$source: 'polling'
	};

	const isGroup = peer < 0;
	const isChat = peer > CHAT_PEER;

	if (isGroup) {
		message.out = Number((flags & 2) === 0);
		message.important = Number((flags & 1) !== 0);
	} else {
		message.out = Number((flags & 2) !== 0);
		message.important = Number((flags & 8) !== 0);
	}

	if (isChat) {
		message.user_id = Number(attachments.from);
		message.chat_id = peer - CHAT_PEER;

		message.title = attachments.title;

		if ('source_act' in attachments) {
			message.action = attachments.source_act;
			message.action_mid = attachments.source_mid;
			message.action_text = attachments.source_text;
		}
	} else {
		message.user_id = peer;
	}

	if ('attach1' in attachments && attachments.attach1_type in specialAttachments) {
		message.attachments = [
			specialAttachments[attachments.attach1_type](attachments)
		];
	} else {
		message.attachments = [];

		for (let i = 1, key = 'attach1'; key in attachments; i += 1, key = `attach${i}`) {
			const type = attachments[`${key}_type`];

			if (type === 'link') {
				const attachment = {
					type: 'link',
					link: {
						url: attachments[`${key}_url`],
						title: attachments[`${key}_title`],
						description: attachments[`${key}_desc`]
					}
				};

				const photoKey = `${key}_photo`;

				if (attachments[photoKey]) {
					const [owner, attachmentId] = attachments[photoKey].split('_');

					attachment.link.photo = {
						id: Number(attachmentId),
						owner_id: Number(owner)
					};
				}

				message.attachments.push(attachment);

				continue;
			}

			const [owner, attachmentId] = attachments[key].split('_');

			const attachment = {
				type,
				[type]: {
					id: Number(attachmentId),
					owner_id: Number(owner)
				}
			};

			const kindKey = `${key}_kind`;

			if (type === 'doc' && kindKey in attachments) {
				attachment[type].kind = attachments[kindKey];
			}

			message.attachments.push(attachment);
		}
	}

	if ('fwd' in attachments) {
		message.fwd_messages = parseFwds(attachments.fwd);
	}

	return message;
}
