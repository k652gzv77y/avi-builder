'use client';
import { projectsPath } from '@/lib/project-url';

/**
 * Form Settings Component
 *
 * Settings panel for form layers with submission handling configuration
 */

import React, { useState, useCallback, useEffect } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { collectionWriteFromSettings, fieldInputKey } from '@/lib/collection-write';
import { useCollectionsStore } from '@/stores/useCollectionsStore';
import SettingsPanel from './SettingsPanel';
import LinkSettings from './LinkSettings';
import type { CollectionWriteSettings, Layer, FormSettings as FormSettingsType, LinkSettingsValue } from '@/types';

interface FormSettingsProps {
  layer: Layer | null;
  onLayerUpdate: (layerId: string, updates: Partial<Layer>) => void;
}

// Simple email validation
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function FormSettings({ layer, onLayerUpdate }: FormSettingsProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [emailOpen, setEmailOpen] = useState(false);
  const [isSmtpEnabled, setIsSmtpEnabled] = useState<boolean | null>(null);
  const [emailToInput, setEmailToInput] = useState('');
  const { collections, fields } = useCollectionsStore();

  // Check if email is enabled in global settings
  useEffect(() => {
    const checkEmailSettings = async () => {
      try {
        const response = await fetch(projectsPath('/api/settings/email'));
        if (response.ok) {
          const result = await response.json();
          const mode = result.data?.mode;
          const enabled = mode === 'custom' || result.data?.enabled === true;
          setIsSmtpEnabled(enabled);
          if (enabled) {
            setEmailOpen(true);
          }
        } else {
          setIsSmtpEnabled(false);
        }
      } catch {
        setIsSmtpEnabled(false);
      }
    };

    checkEmailSettings();
  }, []);

  // Sync local email input with layer data
  useEffect(() => {
    setEmailToInput(layer?.settings?.form?.email_notification?.to || '');
  }, [layer?.settings?.form?.email_notification?.to]);

  // Get current form settings
  const formSettings: FormSettingsType = layer?.settings?.form || {};
  const successAction = formSettings.success_action || 'message';
  const handleRedirectLinkChange = useCallback(
    (value: LinkSettingsValue | null) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          form: {
            ...layer.settings?.form,
            redirect_url: value ?? undefined,
          },
        },
      });
    },
    [layer, onLayerUpdate]
  );

  const handleSettingChange = useCallback(
    (key: keyof FormSettingsType, value: any) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          form: {
            ...layer.settings?.form,
            [key]: value,
          },
        },
      });
    },
    [layer, onLayerUpdate]
  );

  const handleEmailNotificationChange = useCallback(
    (key: keyof NonNullable<FormSettingsType['email_notification']>, value: any) => {
      if (!layer) return;

      onLayerUpdate(layer.id, {
        settings: {
          ...layer.settings,
          form: {
            ...layer.settings?.form,
            email_notification: {
              ...layer.settings?.form?.email_notification,
              enabled: layer.settings?.form?.email_notification?.enabled ?? false,
              to: layer.settings?.form?.email_notification?.to ?? '',
              [key]: value,
            },
          },
        },
      });
    },
    [layer, onLayerUpdate]
  );

  // Only show for form layers
  if (!layer || layer.name !== 'form') {
    return null;
  }

  // Password-protected forms gate access to locked pages — they are wired to
  // /api/page-auth/verify automatically, so the standard form options
  // (success action, redirect, email notification) don't apply.
  const isPasswordForm = formSettings.form_type === 'password_protected';

  if (isPasswordForm) {
    return (
      <SettingsPanel
        title="Form Settings"
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      >
        <div className="text-xs text-muted-foreground leading-relaxed">
          This form gates access to password-protected pages. Style it freely;
          the submit handler is wired automatically. On a wrong password, the
          Error alert layer inside the form is shown.
        </div>
      </SettingsPanel>
    );
  }

  const emailNotification = formSettings.email_notification || { enabled: false, to: '' };
  const isSignIn = formSettings.form_type === 'supabase_sign_in';
  const write = collectionWriteFromSettings(formSettings.collection_write);
  const collectionFields = fields[write.collection_id] || [];
  const matchFields = collectionFields.filter((field) => field.fillable && !field.is_computed && field.type !== 'count' && field.type !== 'status');

  const handleWriteChange = (patch: Partial<CollectionWriteSettings>) => {
    handleSettingChange('collection_write', { ...write, ...patch });
  };

  const handleEmailToChange = (value: string) => {
    setEmailToInput(value);

    if (isValidEmail(value)) {
      // Valid email: save it and enable notification
      handleEmailNotificationChange('to', value);
      if (!emailNotification.enabled) {
        handleEmailNotificationChange('enabled', true);
      }
    } else if (value === '') {
      // Empty: clear and disable notification
      handleEmailNotificationChange('to', '');
      handleEmailNotificationChange('enabled', false);
    }
    // Invalid non-empty: only update local input, don't save
  };

  const handleEmailToBlur = () => {
    if (emailToInput && !isValidEmail(emailToInput)) {
      // Reset to last valid value on blur
      setEmailToInput(emailNotification.to || '');
    }
  };

  return (
    <>
    <SettingsPanel
      title="Form Settings"
      isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-3">
          <Label variant="muted">Purpose</Label>
          <div className="col-span-2 *:w-full">
            <Tabs
              value={isSignIn ? 'sign-in' : 'submit'}
              onValueChange={(value) => handleSettingChange('form_type', value === 'sign-in' ? 'supabase_sign_in' : 'standard')}
            >
              <TabsList className="w-full">
                <TabsTrigger value="submit" className="flex-1 text-xs">Submit</TabsTrigger>
                <TabsTrigger value="sign-in" className="flex-1 text-xs">Sign in</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {isSignIn && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Posts email and password to the project sign-in route and stores the Supabase session. Name the inputs email and password.
          </p>
        )}

        {!isSignIn && (
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="collection-write" className="text-xs">Save to collection</Label>
            <Switch
              id="collection-write"
              size="sm"
              checked={write.enabled}
              onCheckedChange={(checked) => handleWriteChange({ enabled: checked === true })}
            />
          </div>
        )}

        {!isSignIn && write.enabled && (
          <>
            <div className="grid grid-cols-3 items-center">
              <Label variant="muted">Collection</Label>
              <div className="col-span-2">
                <Select
                  value={write.collection_id || undefined}
                  onValueChange={(value) => handleWriteChange({ collection_id: value })}
                >
                  <SelectTrigger aria-label="Collection">
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((collection) => (
                      <SelectItem key={collection.id} value={collection.id}>{collection.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3">
              <Label variant="muted">Write</Label>
              <div className="col-span-2 *:w-full">
                <Tabs
                  value={write.mode}
                  onValueChange={(value) => handleWriteChange({ mode: value === 'update' ? 'update' : 'insert' })}
                >
                  <TabsList className="w-full">
                    <TabsTrigger value="insert" className="flex-1 text-xs">Insert</TabsTrigger>
                    <TabsTrigger value="update" className="flex-1 text-xs">Update</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </div>
            {write.mode === 'update' && (
              <div className="grid grid-cols-3 items-center">
                <Label variant="muted">Match</Label>
                <div className="col-span-2">
                  <Select
                    value={write.match_field_id || undefined}
                    onValueChange={(value) => handleWriteChange({ match_field_id: value })}
                  >
                    <SelectTrigger aria-label="Match field">
                      <SelectValue placeholder="Field" />
                    </SelectTrigger>
                    <SelectContent>
                      {matchFields.map((field) => (
                        <SelectItem key={field.id} value={field.id}>
                          {field.name} ({fieldInputKey(field)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground leading-relaxed">
              Input names must match field keys. A signed-in visitor is required so the write follows collection row security.
            </p>
          </>
        )}

        {/* Success Action Toggle */}
        <div className="grid grid-cols-3">
          <Label variant="muted">Success</Label>
          <div className="col-span-2 *:w-full">
            <Tabs
              value={successAction}
              onValueChange={(value) => handleSettingChange('success_action', value)}
              className="w-full"
            >
              <TabsList className="w-full">
                <TabsTrigger value="message" className="flex-1 text-xs">
                  Message
                </TabsTrigger>
                <TabsTrigger value="redirect" className="flex-1 text-xs">
                  Redirect
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Redirect destination - only show when redirect is selected */}
        {successAction === 'redirect' && (
          <LinkSettings
            mode="standalone"
            value={formSettings.redirect_url}
            onChange={handleRedirectLinkChange}
            gridLayout
            typeLabel="Redirect to"
            allowedTypes={['page', 'url']}
            hideBehavior
          />
        )}

      </div>
    </SettingsPanel>

    <SettingsPanel
      title="Email notification"
      collapsible
      isOpen={emailOpen}
      onToggle={() => setEmailOpen(!emailOpen)}
    >
      {!isSmtpEnabled && isSmtpEnabled !== null && (
        <div className="text-xs text-muted-foreground text-center py-4">
          Configure <a href={projectsPath('/settings/email')} className="underline hover:text-foreground">Email in Settings</a> to use email notifications.
        </div>
      )}

      {isSmtpEnabled && (
        <>
          <div className="grid grid-cols-3">
            <Label variant="muted">Send to</Label>
            <div className="col-span-2 *:w-full">
              <Input
                id="email-to"
                type="email"
                value={emailToInput}
                onChange={(e) => handleEmailToChange(e.target.value)}
                onBlur={handleEmailToBlur}
                placeholder="hello@example.com"
              />
            </div>
          </div>

          {emailNotification.enabled && emailNotification.to && (
            <div className="grid grid-cols-3">
              <Label variant="muted">Subject</Label>
              <div className="col-span-2 *:w-full">
                <Input
                  id="email-subject"
                  value={emailNotification.subject || ''}
                  onChange={(e) => handleEmailNotificationChange('subject', e.target.value)}
                  placeholder="New form submission"
                />
              </div>
            </div>
          )}
        </>
      )}
    </SettingsPanel>
  </>
  );
}
