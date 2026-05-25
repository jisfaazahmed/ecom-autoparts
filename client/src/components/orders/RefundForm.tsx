import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface RefundFormProps {
  onSubmit: (data: any) => Promise<void>;
  isSubmitting: boolean;
  selectedItem?: any;
}

const refundReasons = [
  {
    value: 'defective_product',
    label: 'Defective / Damaged',
    description: 'Product is defective or damaged',
    icon: '⚙️',
  },
  {
    value: 'wrong_item',
    label: 'Wrong Item',
    description: 'Seller sent wrong item',
    icon: '❌',
  },
  {
    value: 'not_as_described',
    label: 'Not as Described',
    description: 'Product doesn\'t match description',
    icon: '📋',
  },
  {
    value: 'damaged_in_transit',
    label: 'Damaged in Transit',
    description: 'Item was damaged during shipping',
    icon: '📦',
  },
  {
    value: 'missing_parts',
    label: 'Missing Parts',
    description: 'Some parts/items are missing',
    icon: '🧩',
  },
  {
    value: 'quality_issue',
    label: 'Quality Issue',
    description: 'Poor quality or doesn\'t work properly',
    icon: '⚠️',
  },
  {
    value: 'changed_mind',
    label: 'Changed Mind',
    description: 'No longer needed/want to return',
    icon: '🤔',
  },
];

const productConditions = [
  { value: 'new_unused', label: 'New & Unused', description: 'Never opened/used' },
  { value: 'used', label: 'Used', description: 'Used but functional' },
  { value: 'damaged', label: 'Damaged', description: 'Has visible damage' },
  { value: 'defective', label: 'Defective', description: 'Not working properly' },
];

const packagingConditions = [
  { value: 'unopened', label: 'Unopened', description: 'Original seal intact' },
  { value: 'opened', label: 'Opened', description: 'Opened but undamaged' },
  { value: 'damaged', label: 'Damaged', description: 'Damaged packaging' },
  { value: 'missing', label: 'Missing', description: 'No packaging included' },
];

export const RefundForm: React.FC<RefundFormProps> = ({
  onSubmit,
  isSubmitting,
  selectedItem,
}) => {
  const [step, setStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState('defective_product');
  const [description, setDescription] = useState('');
  const [descriptionError, setDescriptionError] = useState(false);
  const [productCondition, setProductCondition] = useState('new_unused');
  const [packaging, setPackaging] = useState('unopened');
  const [accessories, setAccessories] = useState('all_included');

  const handleNext = () => {
    if (step === 1 && !description.trim()) {
      setDescriptionError(true);
      return;
    }
    setDescriptionError(false);
    if (step < 3) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    const data = {
      refundType: 'return',
      returnReason: {
        category: selectedReason,
        description,
        detailedExplanation: description,
      },
      productCondition: {
        productState: productCondition,
        packaging,
        accessories,
        returnEligible: true,
      },
    };

    await onSubmit(data);
  };

  return (
    <div className="space-y-6">
      {/* Progress Indicator */}
      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((num) => (
          <div key={num} className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition ${
                num <= step
                  ? 'bg-primary text-slate-900'
                  : 'bg-slate-700 text-slate-400'
              }`}
            >
              {num < step ? <CheckCircle2 className="w-5 h-5" /> : num}
            </div>
            {num < 3 && (
              <div
                className={`w-8 h-0.5 ${
                  num < step ? 'bg-primary' : 'bg-slate-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="grid grid-cols-3 gap-4 text-center mb-6">
        <div
          className={`text-sm ${
            step === 1 ? 'text-primary font-semibold' : 'text-slate-500'
          }`}
        >
          Reason
        </div>
        <div
          className={`text-sm ${
            step === 2 ? 'text-primary font-semibold' : 'text-slate-500'
          }`}
        >
          Condition
        </div>
        <div
          className={`text-sm ${
            step === 3 ? 'text-primary font-semibold' : 'text-slate-500'
          }`}
        >
          Confirm
        </div>
      </div>

      {/* Step 1: Select Return Reason */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-200 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-primary" />
            Why do you want to return this item?
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {refundReasons.map((reason) => (
              <Card
                key={reason.value}
                onClick={() => setSelectedReason(reason.value)}
                className={`cursor-pointer transition border-2 ${
                  selectedReason === reason.value
                    ? 'border-primary bg-primary/10'
                    : 'border-slate-700 hover:border-slate-600'
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{reason.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-200">{reason.label}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        {reason.description}
                      </p>
                    </div>
                    <RadioGroup value={selectedReason}>
                      <RadioGroupItem value={reason.value} className="mt-1" />
                    </RadioGroup>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div>
            <Label className="text-slate-300 mb-2 block">
              Please describe the issue: <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); if (e.target.value.trim()) setDescriptionError(false); }}
              placeholder="Provide detailed explanation of the issue..."
              className={`bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500 min-h-24 ${descriptionError ? 'border-red-500' : ''}`}
            />
            {descriptionError && (
              <p className="text-red-400 text-xs mt-1">Please describe the issue before continuing.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Product Condition */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              What's the condition of the item?
            </h3>

            {/* Product State */}
            <div className="mb-6">
              <Label className="text-slate-300 mb-3 block font-medium">
                Item Condition:
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {productConditions.map((condition) => (
                  <Card
                    key={condition.value}
                    onClick={() => setProductCondition(condition.value)}
                    className={`cursor-pointer transition border-2 ${
                      productCondition === condition.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <CardContent className="p-3">
                      <p className="font-semibold text-slate-200 text-sm">
                        {condition.label}
                      </p>
                      <p className="text-xs text-slate-400">
                        {condition.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Packaging */}
            <div className="mb-6">
              <Label className="text-slate-300 mb-3 block font-medium">
                Packaging Condition:
              </Label>
              <div className="grid grid-cols-2 gap-3">
                {packagingConditions.map((pkg) => (
                  <Card
                    key={pkg.value}
                    onClick={() => setPackaging(pkg.value)}
                    className={`cursor-pointer transition border-2 ${
                      packaging === pkg.value
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    <CardContent className="p-3">
                      <p className="font-semibold text-slate-200 text-sm">
                        {pkg.label}
                      </p>
                      <p className="text-xs text-slate-400">{pkg.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Accessories */}
            <div>
              <Label className="text-slate-300 mb-3 block font-medium">
                Accessories & Parts:
              </Label>
              <Select value={accessories} onValueChange={setAccessories}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem
                    value="all_included"
                    className="text-slate-200 focus:bg-slate-600"
                  >
                    All included
                  </SelectItem>
                  <SelectItem
                    value="missing_some"
                    className="text-slate-200 focus:bg-slate-600"
                  >
                    Missing some
                  </SelectItem>
                  <SelectItem
                    value="missing_all"
                    className="text-slate-200 focus:bg-slate-600"
                  >
                    Missing all
                  </SelectItem>
                  <SelectItem
                    value="not_applicable"
                    className="text-slate-200 focus:bg-slate-600"
                  >
                    N/A
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-sm text-blue-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Accurate condition details help us process your refund faster
              </span>
            </p>
          </Card>
        </div>
      )}

      {/* Step 3: Review & Confirm */}
      {step === 3 && (
        <div className="space-y-6">
          <h3 className="font-semibold text-slate-200 mb-4">
            Review Your Return Request
          </h3>

          <Card className="border-slate-700 bg-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Product</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-slate-200">
                {selectedItem?.item?.product?.name || selectedItem?.item?.name}
              </p>
              <p className="text-xs text-slate-400">
                Order: {selectedItem?.orderNumber}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Return Reason</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-slate-200">
                {
                  refundReasons.find((r) => r.value === selectedReason)
                    ?.label
                }
              </p>
              <p className="text-slate-400 text-sm">{description}</p>
            </CardContent>
          </Card>

          <Card className="border-slate-700 bg-slate-700/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Item Condition</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-300">
              <p>
                <span className="text-slate-400">State:</span>{' '}
                {
                  productConditions.find((c) => c.value === productCondition)
                    ?.label
                }
              </p>
              <p>
                <span className="text-slate-400">Packaging:</span>{' '}
                {packagingConditions.find((p) => p.value === packaging)?.label}
              </p>
              <p>
                <span className="text-slate-400">Accessories:</span> {accessories}
              </p>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/10">
            <CardContent className="pt-4">
              <p className="text-sm text-green-300 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  By submitting this return request, you agree to our return
                  policy
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 pt-6 border-t border-slate-700">
        <Button
          onClick={handleBack}
          disabled={step === 1}
          variant="outline"
          className="border-slate-600 text-slate-300 flex-1"
        >
          Back
        </Button>

        {step < 3 ? (
          <Button
            onClick={handleNext}
            className="bg-primary hover:bg-primary/90 text-slate-900 flex-1"
          >
            Next
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            className="bg-green-600 hover:bg-green-700 text-white flex-1"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Return Request'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default RefundForm;
