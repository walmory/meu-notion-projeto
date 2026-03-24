import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Check, X, Bell } from 'lucide-react';
import { api, getAuthHeaders } from '@/lib/api';
import { toast } from 'sonner';
import { mutate } from 'swr';

interface Invitation {
  id: string;
  workspace_id: string;
  workspace_name: string;
  status: string;
  inviter_name: string;
  inviter_avatar: string | null;
}

interface InvitationModalProps {
  invitation: Invitation | null;
  onClose: () => void;
}

export function InvitationModal({ invitation, onClose }: InvitationModalProps) {
  const isOpen = invitation !== null;

  const handleAction = async (action: 'accepted' | 'declined') => {
    if (!invitation) return;
    try {
      await api.patch(`/user/invitations/${invitation.id}`, { status: action }, { headers: getAuthHeaders() });
      if (action === 'accepted') {
        toast.success('Convite aceito!');
        mutate('/user/connections');
      } else {
        toast.success('Convite recusado');
      }
      mutate('/user/invitations');
      onClose();
    } catch (error) {
      console.error('Falha ao processar convite', error);
      toast.error('Falha ao processar convite');
    }
  };

  const handleDismiss = async () => {
    if (!invitation) return;
    try {
      // Just dismiss visually, or update status to 'dismissed' so it doesn't pop up again
      await api.patch(`/user/invitations/${invitation.id}`, { status: 'dismissed' }, { headers: getAuthHeaders() });
      mutate('/user/invitations');
      onClose();
    } catch (error) {
      console.error(error);
      onClose();
    }
  };

  if (!invitation) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="bg-[#191919] border-[#3f3f3f] text-white sm:max-w-md p-0 overflow-hidden shadow-2xl rounded-2xl">
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#2c2c2c] border-2 border-[#2eaadc] flex items-center justify-center overflow-hidden mb-4 shadow-[0_0_15px_rgba(46,170,220,0.3)]">
            {invitation.inviter_avatar ? (
              <img src={invitation.inviter_avatar} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <Bell size={28} className="text-[#2eaadc]" />
            )}
          </div>
          
          <h2 className="text-xl font-bold mb-2">Novo Convite de Workspace</h2>
          <p className="text-[#a3a3a3] text-sm mb-6">
            <strong className="text-white">{invitation.inviter_name}</strong> convidou você para colaborar no workspace{' '}
            <strong className="text-white">&quot;{invitation.workspace_name}&quot;</strong>.
          </p>

          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={() => handleAction('declined')}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 py-2.5 rounded-xl text-sm font-medium transition-colors"
            >
              <X size={16} /> Decline
            </button>
            <button
              type="button"
              onClick={() => handleAction('accepted')}
              className="flex-1 flex items-center justify-center gap-2 bg-[#2eaadc] text-white hover:bg-[#2eaadc]/90 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-[#2eaadc]/20"
            >
              <Check size={16} /> Accept
            </button>
          </div>
          
          <button
            type="button"
            onClick={handleDismiss}
            className="mt-4 text-xs text-[#666] hover:text-[#a3a3a3] transition-colors"
          >
            Decidir depois (fechar)
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}