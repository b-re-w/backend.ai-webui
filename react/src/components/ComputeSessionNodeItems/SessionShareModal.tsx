/**
 @license
 Copyright (c) 2015-2026 Lablup Inc. All rights reserved.
 */
import { useTanMutation, useTanQuery } from '../../hooks/reactQueryAlias';
import { App, Alert, Form, Input, Popconfirm, Select, Table, Tag } from 'antd';
import {
  BAIButton,
  BAIFlex,
  BAIModal,
  BAIModalProps,
  useBAISignedRequestWithPromise,
} from 'backend.ai-ui';
import { DeleteIcon } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

// Session sharing (BEP-1073): invite members of the session's project.
type SessionShareLevel = 'app' | 'execute';

interface SessionShareNode {
  session_id: string;
  user_id: string;
  email: string;
  username?: string | null;
  level: SessionShareLevel;
  created_at?: string | null;
}

interface SearchSessionSharesPayload {
  items: SessionShareNode[];
  total_count: number;
}

interface ShareFormValues {
  email: string;
  level: SessionShareLevel;
}

export interface SessionShareModalProps extends Omit<BAIModalProps, 'onOk'> {
  sessionId: string;
  onRequestClose: () => void;
}

const SessionShareModal: React.FC<SessionShareModalProps> = ({
  sessionId,
  onRequestClose,
  ...modalProps
}) => {
  'use memo';
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<ShareFormValues>();
  const baiRequestWithPromise = useBAISignedRequestWithPromise();
  const sharesPath = `/v2/sessions/${sessionId}/shares`;

  const {
    data: shares,
    isFetching,
    refetch,
  } = useTanQuery<SearchSessionSharesPayload>({
    queryKey: ['sessionShares', sessionId],
    queryFn: () =>
      baiRequestWithPromise({
        method: 'POST',
        url: `${sharesPath}/search`,
        body: { limit: 100, offset: 0 },
      }),
    enabled: !!modalProps.open,
  });

  const addShare = useTanMutation({
    mutationFn: (values: ShareFormValues) =>
      baiRequestWithPromise({
        method: 'POST',
        url: sharesPath,
        body: { email: values.email.trim(), level: values.level },
      }),
  });

  const removeShare = useTanMutation({
    mutationFn: (userId: string) =>
      baiRequestWithPromise({
        method: 'DELETE',
        url: `${sharesPath}/${userId}`,
      }),
  });

  const errorText = (error: unknown) =>
    (error as { message?: string; title?: string })?.message ||
    (error as { title?: string })?.title ||
    t('session.share.Failed');

  const onAdd = async () => {
    const values = await form.validateFields();
    await addShare
      .mutateAsync(values)
      .then(() => {
        message.success(t('session.share.Shared', { email: values.email }));
        form.resetFields(['email']);
        refetch();
      })
      .catch((error) => message.error(errorText(error)));
  };

  const onRemove = async (share: SessionShareNode) => {
    await removeShare
      .mutateAsync(share.user_id)
      .then(() => {
        message.success(t('session.share.Unshared', { email: share.email }));
        refetch();
      })
      .catch((error) => message.error(errorText(error)));
  };

  return (
    <BAIModal
      title={t('session.share.Title')}
      footer={null}
      onCancel={onRequestClose}
      destroyOnHidden
      {...modalProps}
    >
      <BAIFlex direction="column" align="stretch" gap="md">
        <Alert type="warning" showIcon title={t('session.share.Warning')} />
        <Form
          form={form}
          layout="inline"
          initialValues={{ level: 'app' }}
          style={{ rowGap: 8 }}
        >
          <Form.Item
            name="email"
            style={{ flex: 1, minWidth: 200 }}
            rules={[
              { required: true, message: t('session.share.EmailRequired') },
              { type: 'email', message: t('session.share.EmailRequired') },
            ]}
          >
            <Input placeholder={t('session.share.InviteeEmail')} />
          </Form.Item>
          <Form.Item name="level">
            <Select
              style={{ width: 170 }}
              options={[
                { value: 'app', label: t('session.share.LevelApp') },
                { value: 'execute', label: t('session.share.LevelExecute') },
              ]}
            />
          </Form.Item>
          <Form.Item style={{ marginInlineEnd: 0 }}>
            <BAIButton type="primary" action={onAdd}>
              {t('session.share.Invite')}
            </BAIButton>
          </Form.Item>
        </Form>
        <Table<SessionShareNode>
          size="small"
          rowKey="user_id"
          loading={isFetching}
          dataSource={shares?.items ?? []}
          pagination={false}
          locale={{ emptyText: t('session.share.NoInvitees') }}
          columns={[
            {
              title: t('session.share.Invitee'),
              dataIndex: 'email',
              render: (email: string, share) =>
                share.username ? `${email} (${share.username})` : email,
            },
            {
              title: t('session.share.Level'),
              dataIndex: 'level',
              width: 150,
              render: (level: SessionShareLevel) => (
                <Tag color={level === 'execute' ? 'orange' : 'blue'}>
                  {level === 'execute'
                    ? t('session.share.LevelExecute')
                    : t('session.share.LevelApp')}
                </Tag>
              ),
            },
            {
              key: 'actions',
              width: 56,
              render: (_value, share) => (
                <Popconfirm
                  title={t('session.share.ConfirmUnshare', {
                    email: share.email,
                  })}
                  onConfirm={() => onRemove(share)}
                >
                  <BAIButton
                    type="text"
                    danger
                    icon={<DeleteIcon />}
                    aria-label={t('session.share.Unshare')}
                  />
                </Popconfirm>
              ),
            },
          ]}
        />
      </BAIFlex>
    </BAIModal>
  );
};

export default SessionShareModal;
