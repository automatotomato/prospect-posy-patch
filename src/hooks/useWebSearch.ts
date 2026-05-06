import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Prospect } from '@/types/prospect';

interface SearchResult {
  email?: string;
  phone?: string;
  address?: string;
  contactName?: string;
  website?: string;
  confidence?: string;
  sources?: string[];
}

interface UseWebSearchOptions {
  onUpdate?: (updates: Partial<Prospect>) => void;
}

export function useWebSearch(options: UseWebSearchOptions = {}) {
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const searchAndUpdate = async (prospect: Prospect): Promise<SearchResult | null> => {
    setIsSearching(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('search-business-info', {
        body: {
          businessName: prospect.businessName,
          phone: prospect.phone,
          location: prospect.location,
        },
      });

      if (error) {
        console.error('Search error:', error);
        toast({
          title: 'Search failed',
          description: error.message || 'Could not search for business info',
          variant: 'destructive',
        });
        return null;
      }

      const result = data as SearchResult;
      
      // Check what new info was found
      const updates: Partial<Prospect> = {};
      const foundItems: string[] = [];

      if (result.email && !prospect.email) {
        updates.email = result.email;
        foundItems.push(`Email: ${result.email}`);
      }
      if (result.phone && !prospect.phone) {
        updates.phone = result.phone;
        foundItems.push(`Phone: ${result.phone}`);
      }
      if (result.contactName && !prospect.contactName) {
        updates.contactName = result.contactName;
        foundItems.push(`Contact: ${result.contactName}`);
      }
      if (foundItems.length > 0) {
        // Auto-update if handler provided
        if (options.onUpdate) {
          options.onUpdate(updates);
        }
        
        toast({
          title: 'Contact info found!',
          description: foundItems.join('\n'),
        });
      } else {
        toast({
          title: 'No new info found',
          description: 'Search completed but no additional contact info was found.',
        });
      }

      return result;
    } catch (err) {
      console.error('Search error:', err);
      toast({
        title: 'Search failed',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsSearching(false);
    }
  };

  return {
    isSearching,
    searchAndUpdate,
  };
}
